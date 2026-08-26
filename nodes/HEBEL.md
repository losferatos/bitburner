# Hebel — das Optimierungsprotokoll

**Diese Datei ist die Verlustfunktion des Optimierungs-Loops.** Ohne sie wäre er
ein Bastler: Er würde alle drei Stunden etwas ändern, und niemand wüsste
hinterher, welche Änderung getragen hat und welche geschadet.

Jeder Eintrag braucht drei Zahlen — vorher, nachher, und wie lange dazwischen
gemessen wurde. Ein Eintrag ohne Nachher-Messung ist kein Ergebnis, sondern eine
offene Wette.

## Regeln

- **Eine Änderung je Lauf.** Zwei gleichzeitig sind nicht mehr auseinanderzuhalten.
- **Vorher messen, ändern, nachher messen.** Mindestens 20 Minuten Abstand,
  sonst misst man Rauschen.
- **Wird die Zahl schlechter, wird zurückgenommen** — `git revert`, und der
  Eintrag bleibt trotzdem stehen. Eine widerlegte Hypothese ist wertvoll: Sie
  verhindert, dass jemand dieselbe in zwei Wochen noch einmal probiert.
- **Kein Hebel ohne Zahl.** „Fühlt sich besser an" ist kein Ergebnis.

## Was ein guter Hebel ist

Der Engpass, nicht das Naheliegende. In BitNode 6 hängt alles am
Bladeburner-Rang; eine Verbesserung der Hackrate ist dort messbar richtig und
strategisch wertlos. Die Frage lautet immer: **Welche Zahl bringt den Knoten
näher an seinen Ausgang, und was begrenzt sie gerade?**

Quellen, in dieser Reihenfolge:
1. `data/*.json` über die Brücke — was der Bot tatsächlich tut
2. `doku/formeln-*.md` — was daran schon verstanden ist
3. `reference/bitburner-src/` — der Spielquellcode selbst, wenn die Doku
   schweigt oder veraltet ist

---

## Protokoll

*Neueste zuoberst.*

### Geprueft und verworfen: Team, Ausdauerschwelle, Punkterate (26.08., 15:57)

Kein Hebel in diesem Lauf. Drei Kandidaten am Quellcode geprueft, alle drei
tragen heute nicht - das steht hier, damit sie niemand ein zweites Mal aufruft.

**Bladeburner-Team.** `operationTeamSuccessBonus` ist
`(teamCount + 1)^0,05` (`Actions/Operation.ts:96-98`). Zwanzig Mann bringen
`21^0,05 = 1,164`, hundert Mann 1,259 - und der Bonus haengt **nur an
Operationen und Black Ops** (`Actions/Action.ts:124-126` gibt fuer alles andere
1 zurueck). Der Motor faehrt ausschliesslich Vertraege, also ist die Wirkung
derzeit **exakt null**. Rekrutierung kostet zwar keine Ausdauer, aber die
Erfolgschance ist `charisma^0,45 / (teamSize + 1)`
(`data/GeneralActions.ts:29-31`), und Charisma wurde in diesem Lauf nie
trainiert.
**Vermerk fuer spaeter:** Sobald Operationen oder Black Ops gefahren werden,
ist das Team Pflicht - dann sind es +16 Prozent auf die Erfolgschance, und
bei Raid schlaegt das wegen des Rangverlust-Terms als +25 Prozent auf den
Erwartungswert durch. `setTeamSize` wird von `blade.js` bisher nie aufgerufen,
`teamCount` steht also auf 0.

**Ausdauerschwelle senken.** Nachgerechnet mit den heutigen Zahlen
(V = 5,2 je Minute bei Tracking, R = 2,31, Maximum 79):

    Schwelle 51/56   Spanne 3,95   Arbeit 1,37 min   Ruhe 1,71   Anteil 44,5 %
    Schwelle 30/56   Spanne 20,5   Arbeit 7,10 min   Ruhe 8,90   Anteil 44,4 %

Der Anteil ist identisch - die Spanne ist symmetrisch, sie begrenzt Arbeit und
Ruhe gleichermassen. Unterhalb von 50 Prozent kaeme die Ausdauerstrafe dazu
(`min(1, stamina/(0,5*max))`, `Bladeburner.ts:167-169`), die den Ertrag der
laengeren Arbeitsphase auffrisst. **Damit ist die Verwerfung vom 08:14 zum
zweiten Mal bestaetigt, diesmal mit gemessenen statt geschaetzten Werten.**

**Punkterate getrennt heben.** Geht nicht: Faehigkeitspunkte fallen streng
linear aus dem Rang an - `RanksPerSkillPoint: 3` (`data/Constants.ts:47`),
ausgewertet in `Bladeburner.ts:1282-1289` gegen `maxRank`. Ein Punkt je drei
Rang, ohne Zwischengroesse, an der sich drehen liesse. Die Rueckkopplung ist
damit sauber: mehr Rang, mehr Punkte, bessere Faehigkeiten, mehr Rang - und
der einzige Angriffspunkt bleibt die Rangrate selbst.


### Diplomacy gegen Chaos ueber 50 (26.08., 15:26)

Engpass: Die Erfolgschancen. Sector-12 stand um 14:49 bei Chaos 53,89, und
`Actions/Action.ts:94-101` multipliziert oberhalb von 50 die SCHWIERIGKEIT mit
`sqrt(1 + (chaos - 50))`.

Hypothese: Faellt das Chaos unter 50, steigt die Tracking-Chance von 0,357 auf
mindestens 0,75, weil der Faktor `sqrt(4,89) = 2,21` auf exakt 1 zurueckfaellt.

Beleg: `Actions/Action.ts:94-101` (Schwellwert und Wurzelformel),
`Bladeburner.ts:735-743` und `:1185-1187` (Diplomacy senkt prozentual um
`charisma^0,045 + charisma/1000`), `data/GeneralActions.ts:37-44` (60 Sekunden,
keine Ausdauer).

Vorher: Tracking-Chance 0,357 um 14:49, Rangrate 0,625 je Minute.
Nachher: **Tracking-Chance 0,801 um 15:26** - Faktor 2,24 gegen den
vorhergesagten 2,21. Rangrate **1,361 je Minute** ueber die zwanzig Minuten bis
15:47, Kammeranteil 40 Prozent. Zehn Minuten Diplomacy waren dafuer noetig.

Commit: "blade: Diplomacy gegen Chaos ueber 50"

**Das war der groesste Einzelhebel des Tages** - und er lag seit gestern als
verworfener Nebensatz in einem Offen-Punkt, mit der Begruendung "Chaos unter
50 ist nutzlos". Die Begruendung stimmte, als sie geschrieben wurde. Die
Lehre: **Eine Verwerfung mit Bedingung muss die Bedingung mitpruefen.**


### Cyber's Edge vor Overclock im SKILL_PLAN (26.08., 12:22)

Engpass: Die Regeneration. Der Motor stand 62,9 Prozent der Zeit in der
Kammer und wartete auf Ausdauer.

Hypothese: Cyber's Edge hebt R um 2 Prozent je Stufe, weil
`getSkillMult(Stamina)` in BEIDEN Formeln steckt - `calculateMaxStamina`
(`Bladeburner.ts:1327-1343`) und `calculateStaminaGainPerSecond`
(`:1317-1325`). Die Ruhezeit `S/R` bleibt gleich, die Arbeitszeit `S/(V-R)`
waechst ueberproportional, weil V fest ist.

Mitgeprueft und dabei verworfen: **Overclock ist im Ausdauer-Engpass
wirkungslos.** Der Ausdauerverlust faellt je AKTION an (`Bladeburner.ts:921`),
eine um ein Prozent kuerzere Aktion heisst also auch ein Prozent mehr
Verbrauch je Minute. Nachgerechnet 0,4444 gegen 0,4445 - und es hatte bis
dahin 14 Stufen bekommen, rund 169 Punkte.

Vorher: R = 2,068 Ausdauer je Minute (53 Kammerphasen, 108 min),
Hoechstausdauer 70, Rangrate 0,649 je Minute, Kammeranteil 62,9 Prozent.
Nachher: **R = 2,313** (11 Phasen, 23 min) bei Cyber's Edge Stufe 5,
Hoechstausdauer 79. Das sind 11,8 Prozent - fuenf Stufen zu je zwei Prozent
plus das Agility-Wachstum.

Commit: "blade: Cyber's Edge vor Overclock, Deckel 5"

Die Rangrate stieg im selben Zeitraum von 0,649 auf 0,842. Der Anteil, der
auf Cyber's Edge entfaellt, ist damit **nicht sauber getrennt** - der
Krankenhaus-Hebel und die schwankenden Erfolgschancen liefen mit. Belastbar
ist nur die Regeneration selbst, und die ist die Groesse, auf die der Hebel
zielt.


### bbspann.js rechnete einen irrefuehrenden Ertrag (26.08., 13:05)

Engpass: Nicht der Bot, sondern das Messwerkzeug. Der falsche Ertrag hat um
12:55 einen Auftrag mit hoher Dringlichkeit erzeugt ("Operationen bringen das
Siebenfache"), der so nicht stimmt.

Zwei Fehler, die sich gegenseitig verstaerkten:
- **Levelfaktor fehlte.** `Bladeburner.ts:917` multipliziert den Ertrag mit
  `rewardFac^(level-1)`. Tracking steht auf Stufe 29 (1,041^28 = 3,07), alle
  Operationen auf Stufe 1. Verglichen wurde eine ausgereizte Aktion mit einer
  frischen.
- **Rangverlust fehlte.** Nur Operationen haben `rankLoss` (Operations.ts:20,
  54, 90, 125, 165, 203). Bei Chancen unter 0,2 dominiert dieser Term.

Beleg: `Bladeburner.ts:917` (Levelfaktor), `:975-978` (`changeRank` mit
negativem Vorzeichen bei Misserfolg), `data/Operations.ts` (rankLoss, hpLoss).

Gemessen 13:05 mit der korrigierten Rechnung - `netto` gegen `brutto`, wie es
vorher dastand:

    Aktion                 Stufe  Chance   netto/min   brutto/min
    Tracking                  29   0,700       2,425        0,787
    Retirement                16   0,434       1,828        0,711
    Bounty Hunter             12   0,363       1,783        0,727
    Raid                       1   0,103       3,669        6,071
    Undercover Operation       1   0,225       1,166        1,697
    Investigation              1   0,271       0,965        1,277
    Sting Operation            1   0,142       0,461        1,021
    Stealth Retirement         1   0,087       0,077        1,642
    Assassination              1   0,055      -0,772        1,408

**Drei Ergebnisse:**
1. **Assassination hat einen negativen Erwartungswert**, Stealth Retirement
   einen von praktisch null. Die alte Zahl wies beiden 1,4 bis 1,6 zu.
2. **Raid ist besser, aber um Faktor 1,5 statt 7.** Der Auftrag von 12:55
   bleibt bestehen, mit korrigierter Zahl.
3. **Der Levelfaktor ist der Grund, warum Vertraege mithalten.** Tracking
   bringt roh 0,3 Rang, effektiv 0,92. Das ist kein Argument gegen
   Operationen, sondern eines dafuer, eine davon HOCHZUSPIELEN - jede
   Operationsstufe zahlt 7 bis 14 Prozent, gegen 4,1 bei Tracking.

Vorher: kein Vergleichswert - die Zahl war vorher schlicht falsch.
Nachher: Die Datei fuehrt jetzt `gewinnEff`, `rangVerlust`, `hpJeMisserfolg`,
`ertragJeMinute` (netto) und `bruttoJeMinute` (die alte Zahl, zum Vergleich).
Commit: siehe unten.

**Keine Aenderung am Bot in diesem Lauf.** Der Hebel ist gerechnet und liegt
bei Raid, aber er haengt an einer ungeklaerten Frage: Raid nimmt 50
Trefferpunkte je Misserfolg (`data/Operations.ts:126`) bei einem Maximum von
25, also **Krankenhaus bei jedem einzelnen Fehlschlag** - und ob eine
Hospitalisierung die laufende Bladeburner-Aktion abbricht, ist nicht geprueft.
Das gehoert vor jede Aenderung an `SICHER_OPERATION`.


### Die Kammerzeit ist strukturell - gerechnet, keine Aenderung (26.08., 11:45)

**Ziel dieses Laufs war die Frage, ob gegen die 55 Prozent Kammerzeit
ueberhaupt ein Hebel existiert.** Antwort: kaum. Zum ersten Mal mit echten
Zahlen statt Schaetzungen, gemessen ueber 161 Abschnitte seit 09:15:

    Regenerationskammer     +2,04 Ausdauer je Minute
    Contracts/Tracking      -4,09 je Minute netto   (2,18 Rang/min)
    Contracts/Retirement    -2,50                   (1,71)
    Contracts/Bounty Hunter -2,17                   (1,60)

Daraus folgt der Kammeranteil zwingend, denn Arbeit und Ruhe teilen sich
dieselbe Spanne:

    Anteil = (1/R) / (1/V + 1/R)

    mit Tracking        66,7 %   ->  Zyklusrate 2,18 * 0,333 = 0,726 Rang/min
    mit Bounty Hunter   51,5 %   ->              1,60 * 0,485 = 0,776

Gemessen wurden 55 Prozent - die Mischung passt.

**Zwei Ergebnisse:**

1. **Bounty Hunter ist tatsaechlich besser, aber nur um sieben Prozent** -
   nicht um die 44, die die Rechnung von 09:46 ergab. Der Unterschied
   verschwindet im Rauschen, und genau deshalb war in der Messung von
   09:57-10:14 nichts davon zu sehen. Die Umstellung bleibt zurueckgedreht;
   sieben Prozent rechtfertigen die zusaetzliche Verwicklung nicht.

2. **Die Kammerzeit laesst sich mit der Aktionsauswahl allein nicht unter
   etwa 50 Prozent druecken.** Selbst die sparsamste Aktion verbraucht mehr
   als das Doppelte dessen, was die Kammer nachliefert. Eine Aktion mit
   Verbrauch nahe 2,04 gaebe zwar wenig Kammerzeit, braechte aber auch
   entsprechend wenig Rang.

**Was den Knoten wirklich beschleunigen wuerde, haengt an
Faehigkeitspunkten** - hoehere Regeneration (Cyber's Edge), hoehere
Erfolgschancen (Blade's Intuition, Tracer), kuerzere Aktionen (Overclock).
Alle drei Multiplikatoren kosten Punkte, und die kommen aus Rangaufstiegen.
Gemessen 10:45: **null Punkte.** Der eigentliche Engpass ist damit nicht die
Kammerzeit, sondern dass nichts da ist, um die Multiplikatoren zu heben.

Vorher: 0,707 Rang je Minute, 55,9 Prozent Kammerzeit (10:49-11:15)
Nachher: (keine Aenderung - dies ist die Absage an weitere Versuche in diese
Richtung)
Commit: siehe git log, HEBEL.md 26.08. 11:45

### Incite Violence, wenn der beste Vertrag leergespielt ist (26.08., 10:49)

Engpass: **Der Vorrat, nicht die Auswahl.** Gemessen 10:45: Tracking hat noch
1,0 offene Auftraege (von ueber 200), seine Chance ist von 0,74 auf 0,525
gefallen. Bounty Hunter und Retirement liegen bei 0,273 und 0,324 - beide
unter der Sicherheitsschwelle von 0,45. Die Rangrate ist deshalb von 0,926 auf
0,60 je Minute eingebrochen.

Hypothese: `Incite Violence` fuellt ALLE Vertraege und Operationen auf einen
Schlag - es rechnet 180 Wachstumsschritte gut (`Bladeburner.ts:1219-1225`,
`60 * 3 * growthFunction()`). Es dauert 60 Sekunden und kostet **keine
Ausdauer** (`data/GeneralActions.ts:52-58`), was gerade dann zaehlt, wenn die
Ausdauer der Engpass ist. Erwartung: Die Rate kehrt auf **ueber 0,9** zurueck.

Die Rechnung: Eine Minute Incite kostet den Ertrag des Notvertrags (Bounty
Hunter, 0,567 Rang je Minute). Danach ist Tracking mit 2,2 wieder da - der
Verlust ist nach gut dreissig Sekunden eingespielt.

**Chaos geprueft, bevor es zum Problem wird:** Incite hebt das Chaos jeder
Stadt um 10 plus `chaos/log10(chaos)`. Erst ueber **50** macht Chaos die
Aktionen schwerer (`ChaosThreshold`, `Actions/Action.ts:94-101`); Sector-12
steht bei 13. Ein Durchlauf bringt es auf etwa 35, ein zweiter darueber -
deshalb greift der Block nur unter Chaos 25.

Damit ist auch der zweite Teil des alten Baustellenpunkts entschieden:
**Diplomacy braucht es vorerst nicht.** Es senkt Chaos, und Chaos schadet
unterhalb von 50 gar nicht.

Vorher: 0,602 Rang je Minute, Tracking-Vorrat 1,0 (10:16-10:44)
Nachher: (offen - naechster Lauf misst)
Erste Beobachtung 10:50: Tracking ist nachgewachsen und laeuft wieder ueber
der Schwelle, der Block hat also noch nicht ausgeloest. Er greift beim
naechsten Leerlauf.
Commit: siehe git log, blade.js 26.08. 10:49

### Auswahl nach Rang je Ausdauer, selbstkalibrierend (26.08., 09:57)

Engpass: 55 Prozent Kammerzeit, allein wegen Ausdauer. Die Minuten sind
reichlich da, die Ausdauer ist knapp - also zaehlt Rang je AUSDAUERPUNKT.

Hypothese und Rechnung stehen im Eintrag von 09:46: Ueber den vollen Zyklus
aus Arbeit und Ruhe gewinnt Bounty Hunter (0,989 Rang je Ausdauer) gegen
Tracking (0,533) um **Faktor 1,44**, obwohl Tracking bei Rang je Minute vorne
liegt. Erwartung: Die Rangrate steigt von **0,926 auf mindestens 1,15** je
Minute.

Umgesetzt **selbstkalibrierend**, nicht als Tabelle: `blade.js` liest alle
fuenf Minuten die juengsten dreihundert Abschnitte aus `data/aktionen.txt` -
derselben Datei, die es selbst fuellt - und rechnet daraus den Verbrauch je
Aktion. Damit passt sich die Auswahl an steigende Aktionslevel an, statt auf
den Zahlen von heute stehen zu bleiben. Aktionen mit weniger als fuenf
Abschnitten bekommen den Durchschnitt der uebrigen als Schaetzwert.

**Zwei Einheitenfehler in einem Lauf, beide selbst verursacht und behoben:**
1. 09:54: Ungemessene Aktionen fielen auf "Rang je Minute" zurueck - eine
   voellig andere Skala (0,77 gegen 0,19). Der Rueckfall gewann dadurch immer,
   und der Motor fuhr prompt Retirement, die einzige Aktion ohne Messwert.
   Behoben durch den Durchschnitts-Schaetzwert.
2. 09:55: Der Notvertrag-Zweig vergleicht gegen Field Analysis, und General-
   Aktionen kosten gar keine Ausdauer - der Vergleich geht nur ueber die Zeit.
   Der Motor landete auf Field Analysis mit 0,2 Rang je Minute. Behoben:
   `beste()` fuehrt jetzt BEIDE Zahlen mit, `ertrag` fuer die Auswahl und
   `proMinute` fuer den Vergleich mit General-Aktionen.

Wer die Bewertungsgroesse aendert, muss JEDEN Vergleich mitziehen, in dem sie
vorkommt. Das ist die Lehre.

Beleg: `Bladeburner.ts:921` (Ausdauerverlust je Aktion), `1317-1325`
(Regeneration), eigene Messung ueber 295 Abschnitte.

Vorher: 0,926 Rang je Minute, 55,5 Prozent Kammerzeit (09:19-09:45)
Nachher: **WIDERLEGT, zurueckgedreht um 10:15.**

    vorher (09:19-09:45)   55,5 % Kammer   0,926 Rang/min
    danach (09:57-10:14)   62,3 % Kammer   0,606 Rang/min

Erwartet waren mindestens 1,15. Gemessen ist ein Drittel WENIGER - und selbst
auf siebzehn Minuten Messstrecke ist das kein Rauschen mehr.

**Was die Rechnung uebersehen hat:** Bounty Hunter liegt mit 44 Prozent
Erfolgschance UNTER der Sicherheitsschwelle und lief nur ueber den
Notvertrag-Zweig. Mehr als die Haelfte der Versuche schlaegt fehl, und jeder
Fehlschlag kostet die volle Ausdauer bei null Rang. Die Kennzahl "Rang je
Ausdauer" aus `ratencheck.js` enthaelt diese Fehlschlaege zwar, aber der
Zyklus rechnet sich dadurch anders als angenommen: Die Ausdauer ist schneller
weg, ohne dass die kuerzere Arbeitsphase das ausgleicht.

Zurueckgedreht wurde NUR das Auswahlkriterium - ausgewaehlt wird wieder nach
Rang je Minute. **Die Messung bleibt** (`kostenAktualisieren` in blade.js):
Sie kostet nichts, liefert weiter Daten, und die naechste Hypothese kann
darauf aufbauen, statt bei null anzufangen.

**KORREKTUR 10:50 - die Widerlegung war selbst falsch.** Nach dem
Zurueckdrehen gemessen:

    mit neuer Auswahl (09:57-10:14)   62,3 % Kammer   0,606 Rang/min
    zurueckgedreht    (10:16-10:44)   55,7 % Kammer   0,602 Rang/min

**Die Rate blieb unten.** Die Auswahl war also nicht die Ursache - sie war
unschuldig. Gefunden 10:45 ueber `data/bbspann.json`:

    Tracking        Chance 0,525 (war 0,74)   offen  1,0   <- leergespielt
    Bounty Hunter   Chance 0,273 (war 0,44)   offen  487
    Retirement      Chance 0,324 (war 0,45)   offen  359

Der **Vorrat des besten Vertrags war erschoepft**, und der Motor fiel auf
Aktionen zurueck, deren Erfolgschance unter der Sicherheitsschwelle liegt.
Genau in dieses Loch fiel die Messung der neuen Auswahl.

Die Aenderung bleibt trotzdem zurueckgedreht: Sie ist damit weder belegt noch
widerlegt, und ohne Beleg faehrt der Motor die einfachere Regel. Wer sie
erneut probiert, braucht eine Strecke mit gefuellten Vorraeten.

Drei Lehren, alle teuer bezahlt:
1. Wer die Bewertungsgroesse aendert, muss JEDEN Vergleich mitziehen, in dem
   sie vorkommt (zwei Einheitenfehler in einem Lauf, siehe oben).
2. Eine Zyklusrechnung auf dem Papier ersetzt keine Messung. Der Faktor 1,44
   war sauber hergeleitet und trotzdem falsch.
3. **Eine Widerlegung braucht dieselbe Sorgfalt wie eine Bestaetigung.** Ich
   habe eine Aenderung fuer schuldig erklaert, ohne zu pruefen, ob die Zahl
   nach dem Zurueckdrehen wieder steigt. Sie tat es nicht.
Commit: siehe git log, blade.js 26.08. 09:57

### Die Auswahl misst die falsche Groesse - gerechnet, noch nicht umgesetzt (26.08., 09:46)

Engpass: 55 Prozent Kammerzeit, allein wegen Ausdauer. Wenn die Ausdauer der
Engpass ist, zaehlt **Rang je Ausdauerpunkt**, nicht Rang je Minute - und die
Auswahl in `blade.js` optimiert bis heute Letzteres.

Gemessen 09:45 ueber 295 Abschnitte (`tools/ratencheck.js`):

    Aktion                   Rang/min   Rang/Ausdauer   Ausdauer/Lauf   s/Lauf
    Contracts/Tracking          2,180           0,533            1,17       26
    Contracts/Bounty Hunter     1,710           0,989            1,78       48

**Die beiden Kennzahlen widersprechen sich.** Tracking ist in der Arbeitszeit
schneller, Bounty Hunter je Ausdauerpunkt fast doppelt so ergiebig.

Ueber den vollen Zyklus aus Arbeit UND Ruhe gerechnet, mit Budget B (die
Hysteresespanne) und 1,2 Ausdauer je Minute passiver Regeneration, in der
Kammer verdoppelt:

    Bounty Hunter   Verbrauch 2,22/min, netto 1,02  ->  Zyklus 1,397 B, Rang 0,989 B  =  0,708 Rang/min
    Tracking        Verbrauch 2,70/min, netto 1,50  ->  Zyklus 1,084 B, Rang 0,533 B  =  0,492 Rang/min

**Bounty Hunter gewinnt ueber den vollen Zyklus um Faktor 1,44**, obwohl die
bisherige Kennzahl Tracking vorne sieht. Die Absolutwerte des Modells passen
nicht exakt zur Messung (0,708 gegen gemessene 0,93 ueber alles) - das
Verhaeltnis ist die belastbare Aussage, nicht die Zahl.

**Bewusst NICHT in diesem Lauf umgesetzt.** Die saubere Loesung ist
selbstkalibrierend: `blade.js` liest den gemessenen Verbrauch je Aktion aus
`data/aktionen.txt` und waehlt danach. Eine hartkodierte Tabelle aus dreissig
Minuten Messung waere genau der Fehler, gegen den `tools/ratencheck.js`
ueberhaupt gebaut wurde - und Retirement fehlt in der Messung noch ganz.

Ausserdem korrigiert: Der erste Lauf um 09:18 meldete "Tracking 99,8 Rang je
Ausdauer". Diese Zahl war falsch - der Zaehler stammte aus allen Abschnitten,
der Nenner nur aus denen mit Ausdauermessung. Nach der Korrektur sind es 0,533,
und die Rangfolge kehrt sich um.

Vorher: 0,926 Rang je Minute, 55,5 Prozent Kammerzeit (09:19)
Nachher: (keine Aenderung - dies ist die Rechnung, die der Aenderung vorausgeht)
Commit: siehe git log, ratencheck.js 26.08. 09:45

### Ausdauer-Ruhespanne von 52/60 auf 51/56 Prozent (26.08., 07:46)

Engpass: Nach dem Krankenhaus-Hebel ist die Ausdauer der letzte Grund, aus dem
der Motor ruht - gemessen **33,5 Prozent der Zeit** (07:15).

Hypothese: Die Haelfte davon ist geschenkt. Die Spanne von 52 auf 60 Prozent
sind acht Prozent der Hoechstausdauer, bei 64 also gut fuenf Punkte; die
Regeneration betraegt rund 1,2 je Minute (`Bladeburner.ts:1317-1325`), macht
vier Minuten Ruhe je Zyklus. Die Strafe beginnt aber erst UNTER 50 Prozent
(`min(1, stamina/(0,5*max))`, `Bladeburner.ts:167-169`) - alles zwischen 50
und 100 ist gleich gut. 51 auf 56 haelt denselben Abstand zur Strafgrenze und
halbiert die Ruhezeit. Erwartung: Kammeranteil von 33,5 auf unter 25 Prozent,
Rangrate rund ein Zehntel hoeher.

Beleg: `Bladeburner.ts:167-169` (die Strafe und ihre Grenze), `1317-1325`
(Regeneration), `1327-1343` (Hoechstausdauer).

**Geprueft und fuer jetzt verworfen: die Faehigkeit "Cyber's Edge."** Sie hebt
die Hoechstausdauer um 2 Prozent je Stufe (`Skills.ts:84-89`) - und weil
`getSkillMult(Stamina)` in BEIDEN Formeln steckt, auch die Regeneration. Der
Ruheanteil sinkt dadurch tatsaechlich, aber nur schwach: Bei gleicher
prozentualer Steigerung von Reserve und Regeneration bleibt die Ruhezeit
gleich, waehrend die Arbeitsphase mitwaechst. Drei Stufen kosten 1+3+9 = 13
Punkte (baseCost 1, costInc 3) und braechten rund sechs Prozent laengere
Arbeitsphasen, also gut zwei Prozent Rate - dieselbe Groessenordnung wie eine
Stufe Overclock fuer zehn Punkte. Kein klarer Gewinner, deshalb keine
Aenderung am Faehigkeitsplan ohne Messung.

Vorher: 50,1 Prozent Kammerzeit, 0,888 Rang je Minute (06:55-07:46, 49 min)
Nachher: **Die Hypothese ist widerlegt.** Gemessen 08:14 ueber 26 Minuten:

    seit 07:46   26,3 min | Kammer 16,0 min = 60,7 % | 0,941 Rang/min

Die Kammerzeit ist nicht gefallen, sondern **gestiegen** - von 50,1 auf 60,7
Prozent. Die Rangrate liegt mit 0,941 gegen 0,888 leicht darueber, aber das
ist bei 26 Minuten Messstrecke nicht von Rauschen zu unterscheiden.

**Der Denkfehler, und er ist lehrreich:** Die Spanne ist SYMMETRISCH. Sie
begrenzt nicht nur, wie lange geruht wird, sondern auch, wie lange gearbeitet
werden darf - von 56 Prozent hinunter auf 51 statt von 60 auf 52. Beide
Phasen schrumpfen um denselben Anteil, das Verhaeltnis bleibt gleich, und
zusaetzlich steigt der Umschalt-Overhead: acht Kammerabschnitte in 26 Minuten
statt weniger, laengerer.

Nicht zurueckgenommen, weil die ZIELGROESSE - die Rangrate - nicht gefallen
ist. Aber der behauptete Mechanismus tritt nicht ein, und der Eintrag bleibt
als Warnung stehen: An der Hysteresespanne zu drehen bringt nichts. Wer die
Ausdauerruhe verkuerzen will, muss an den Verbrauch (leichtere Aktionen) oder
an die Regeneration heran.
Commit: siehe git log, blade.js 26.08. 07:46

### Krankenhaus statt Regenerationskammer (26.08., 06:55)

Engpass: **Der Motor stand 161 von 222 Minuten - 72,5 Prozent - in der
Regenerationskammer** (`tools/ratencheck.js`, 06:47). Die Arbeitszeit bringt
1,4 bis 2,0 Rang je Minute, ueber alles blieben **0,475**. Das ist der
groesste Einzelhebel des Knotens; bei Rang 331 von 2.500 entscheidet er ueber
Tage.

Der Ruhegrund waren fast immer die Trefferpunkte, nicht die Ausdauer. Kein
Wunder: Das Maximum ist `floor(10 + defense/10)` = 23 (`Person.ts:97`), und
die Kammer heilt **2 je Durchlauf** (`Bladeburner.ts:1198`). Von 11 auf 17
sind das drei Durchlaeufe.

Verworfen, bevor es umgesetzt wurde: **mehr Trefferpunkte durch hoeheres
Trainingsziel.** Bei doppeltem Maximum verdoppelt sich die Arbeitsspanne, aber
die Heilung bleibt bei 2 je Durchlauf - die Ruhezeit verdoppelt sich mit. Der
ANTEIL bleibt gleich, und das Training selbst kostet Stunden ohne Rang.

Hypothese: `ns.singularity.hospitalize()` setzt `hp.current` in EINEM Aufruf
auf das Maximum (`PlayerObjectGeneralMethods.ts:281-290`). Es kostet Geld und
sonst nichts - keine Zeit, keine Aktionsunterbrechung; auf das Ereignis hoert
nur die Infiltration (`Infiltration.ts:83`). Kosten:
`min(Guthaben * 0,1, fehlendeHP * 100.000)` (`Hospital.ts:4-10`), bei zwoelf
fehlenden Punkten also 1,2 Millionen gegen ein Guthaben von 7,5 Milliarden.

Erwartung: Die Kammerzeit faellt von 72,5 auf unter 25 Prozent (es bleibt nur
noch die Ausdauer-Ruhe), die Rangrate steigt von **0,475 auf mindestens 1,3**
je Minute.

Untergrenze eingebaut: Unter zehn Millionen Guthaben bleibt die Kammer. Nach
einem Augmentierungs-Einbau zaehlt jeder Euro fuer Server und Programme, und
der Deckel `Guthaben * 0,1` waere dort ein schlechter Tausch.

Vorher: 0,475 Rang je Minute, 72,5 Prozent Kammerzeit (06:47)
Nachher: **1,118 Rang je Minute, 33,5 Prozent Kammerzeit** - gemessen 07:15
ueber die 18 Minuten seit der Aenderung, gegen 229 Minuten davor:

    bis 06:55   229,0 min gesamt, 166,0 in der Kammer (72,5 %)  ->  0,484/min
    ab  06:55    18,1 min gesamt,   6,1 in der Kammer (33,5 %)  ->  1,118/min

**Faktor 2,3 - diese Zahl war zu guenstig.** Nachgemessen 07:47 ueber die
volle Strecke 06:55 bis 07:46 (49 Minuten statt 18):

    06:55-07:46   49,0 min | Kammer 50,1 % | 0,888 Rang/min

Der Hebel bringt also **72,5 auf 50,1 Prozent** und **0,484 auf 0,888** -
Faktor 1,8, nicht 2,3. Die ersten achtzehn Minuten waren ein zu guenstiger
Ausschnitt; wer auf so kurzer Strecke misst, misst Rauschen mit. Die
Erwartung von 1,3 ist damit klar verfehlt, das Ziel von unter 25 Prozent
Kammerzeit ebenso.

Was uebrig bleibt, ist ein ANDERER Engpass: Die verbliebenen 33,5 Prozent sind
Ausdauer-Ruhe, nicht Trefferpunkte. Die Ausdauer regeneriert passiv rund 1,2
je Minute (`Bladeburner.ts:1382`), die Kammer verdoppelt das nur - gegen sie
hilft kein Krankenhaus. Das ist der naechste Hebel, nicht dieser.
Commit: siehe git log, blade.js 26.08. 06:55

### Notvertrag statt Field Analysis (26.08., 00:55)

Engpass: Der Motor stand zweieinhalb Stunden auf `General/Field Analysis` und
kam auf **0,22 Rang je Minute** (Rang 143 um 22:43, 171 um 00:51 - 28 in 128
Minuten). Field Analysis gibt rankGain 0,1, also rund 0,2 je Minute; die
Messung trifft den Wert exakt.

Hypothese: Der Rueckfall ist falsch bemessen. Gemessen 00:52 ueber
`data/bbspann.json`:

    Bounty Hunter   0,381 Chance · 0,9 Rang · 21 s  ->  0,98 Rang/min
    Retirement      0,386        · 0,6      · 21 s  ->  0,70
    Field Analysis  --           · 0,1      · 30 s  ->  0,20

Beide Vertraege lagen knapp unter der Sicherheitsschwelle von 0,45 - und
brachten trotzdem das Drei- bis Fuenffache von Field Analysis. Die Schwelle
vergleicht die Chance mit einer festen Zahl, statt den Ertrag mit der
Alternative. Bei Vertraegen ist ein Misserfolg billig: etwas Ausdauer, etwas
Chaos, kein Rangverlust und kein Toter. Erwartung: mindestens 0,9 statt 0,22.

Beleg: rankGain in `reference/bitburner-src/src/Bladeburner/data/Contracts.ts`
(19, 53, 86) und `data/GeneralActions.ts`; Dauern ueber
`ns.bladeburner.getActionTime`.

Umgesetzt: Faellt kein Vertrag ueber die Schwelle, wird trotzdem der
ertragsstaerkste genommen, sofern er das Anderthalbfache von Field Analysis
bringt. Operationen (Teamverluste) und Black Ops (Tod) behalten ihre
Sicherheitsschwellen unangetastet.

Vorher: 0,22 Rang je Minute (22:43 bis 00:51)
Nachher: **gegriffen, aber selten.** In `data/aktionen.txt` steht bis 06:51
genau EIN Abschnitt mit dem Grund "Vertrag unter Schwelle, lohnt trotzdem" -
der Fall tritt nur ein, wenn gleichzeitig alle Vorraete knapp und alle Chancen
unter 0,45 sind. Der Wert des Hebels liegt darin, dass die Alternative
(Field Analysis mit 0,2 je Minute) nie wieder gewaehlt wird; als Dauerzustand
war er nie gedacht. Nicht zurueckgenommen.

**Naechster Kandidat, bewusst nicht in diesem Lauf:** Auch oberhalb der
Schwelle waehlt der Motor nicht optimal. Um 01:00 fuhr er Tracking (0,78 Rang
je Minute), waehrend Bounty Hunter 0,98 gebracht haette - der lag nur unter
der Schwelle. Konsequent waere, bei VERTRAEGEN ganz auf die Sicherheitsschwelle
zu verzichten und rein nach Ertrag zu waehlen, mit einer harten Untergrenze
gegen Unsinn. Erst messen, was der jetzige Schritt bringt.

Commit: siehe git log, blade.js 26.08. 00:55

### Aktionsauswahl nach Rangertrag je Minute statt nach Erfolgschance (25.08., 21:57)

Engpass: Der Bladeburner-Rang. Bei 129 von 2.500 fuer die erste Black Op und
0,84 Rang je Minute sind das noch **47 Stunden** - das ist die Zahl, an der
dieser Knoten haengt.

Hypothese: Der Motor fuhr die **schlechteste** Aktion der ganzen Liste.
Gemessen 21:56 ueber `data/bbspann.json`, sortiert nach Ertrag je Minute:

    Raid                          0,094 Chance ·   55 Rang ·  62 s  ->  5,00
    Stealth Retirement Operation  0,077        ·   22      ·  77 s  ->  1,32
    Undercover Operation          0,191        ·  4,4      ·  39 s  ->  1,29
    Bounty Hunter                 0,457        ·  0,9      ·  21 s  ->  1,18
    Assassination                 0,049        ·   44      · 116 s  ->  1,11
    Tracking                      0,734        ·  0,3      ·  13 s  ->  1,02
    Investigation                 0,230        ·  2,2      ·  31 s  ->  0,98
    Sting Operation               0,122        ·  5,5      ·  51 s  ->  0,79
    Retirement                    0,449        ·  0,6      ·  21 s  ->  0,77   <- gefahren

Bounty Hunter und Retirement sind gleich lang und praktisch gleich sicher,
aber der eine bringt die Haelfte mehr. Die alte Regel waehlte nach `s.min`
allein und nahm deshalb Retirement, sobald dessen Schaetzung einen Hauch
hoeher lag. Erwartung: Die Rangrate steigt von 0,84 auf mindestens 1,1 je
Minute.

Beleg: rankGain in `reference/bitburner-src/src/Bladeburner/data/`
(Contracts.ts:19, 53, 86 · Operations.ts:19, 53, 89, 124, 164, 202), Dauern
ueber `ns.bladeburner.getActionTime`.

Bewusst NICHT geaendert: die Schwelle fuer Operationen (`SICHER_OPERATION`
0,85). Raid steht mit 5,0 Rang je Minute weit oben, aber bei 9,4 Prozent
Erfolg sind das ueber neunzig Prozent Fehlschlaege - jeder kostet Ausdauer und
Trefferpunkte und erhoeht das Chaos der Stadt, was wiederum alle Chancen
senkt. Das gehoert durchgerechnet, nicht ueberstuerzt.

Vorher: 0,84 Rang je Minute (21:19 bis 21:51, Rang 102 -> 129)
Nachher: **nicht sauber messbar.** Um 22:01 kam ein Augmentierungs-Einbau
dazwischen, danach lag der Motor bis 00:51 bei 0,22 Rang je Minute - aber aus
einem anderen Grund (siehe den Eintrag darueber: Field Analysis statt
Vertraege). Die Auswahl nach Ertrag ist davon unberuehrt richtig; nachzumessen
ist sie erst auf einer Strecke ohne Einbau.
Commit: f5b7f07

### Ausdauer-Hysterese von 55/90 auf 52/60 Prozent (25.08., 20:02)

Engpass: Der Bot verbrachte den Grossteil seiner Zeit in der
Regenerationskammer statt in Vertraegen. Im Messverlauf steht der Rang
zwischen 19:40 und 19:59 unveraendert bei 73, Aktion durchgehend
`General/Hyperbolic Regeneration Chamber`, Ausdauer 29 von 53.

Hypothese: Die Ruhe war ohne Wirkung. Die Ausdauerstrafe ist
`min(1, stamina / (0,5 * maxStamina))` und wirkt an genau einer Stelle:
`competence *= inst.calculateStaminaPenalty()`. Oberhalb von 50 Prozent ist
sie exakt 1 — der Bot ruhte ab 55 Prozent, wo er noch volle Leistung hatte,
und ruhte dann bis 90, was ihm nichts brachte. Erwartung: Der Anteil der
Arbeitszeit steigt von rund 40 auf ueber 80 Prozent, der Rangzuwachs
entsprechend.

Beleg: `reference/bitburner-src/src/Bladeburner/Bladeburner.ts:167-169` (die
Strafe), `Actions/Action.ts:176` (ihre einzige Verwendung),
`Bladeburner.ts:1382` (Ausdauer regeneriert passiv weiter, auch waehrend der
Arbeit — die Kammer verdoppelt das nur).

Mitgeaendert, weil sonst ein neues Problem entstuende: Die Kammer heilte
nebenbei 2 HP je Durchlauf (`Bladeburner.ts:1198`). Bei kurzer Ruhe faellt das
weg, also ruht der Bot jetzt zusaetzlich unter 50 Prozent Trefferpunkten und
arbeitet ab 95 Prozent weiter.

Vorher: Rang 73, unveraendert ueber 19 Minuten Kammer (19:40-19:59)
Nachher: 20:02 sofort nach dem Neustart `Contracts/Tracking` bei Ausdauer
41/53 (77 Prozent) — unter der alten Regel haette er weitergeruht.

**Nachgemessen 21:51:** Auf der einzigen sauberen Strecke (21:19 bis 21:51,
nach dem Neuladen, ohne Drosselung, ohne Engine-Stillstand) stieg der Rang von
102 auf 129 — **0,84 je Minute**. Eine belastbare Vorher-Zahl gibt es nicht:
Alle Strecken davor sind durch die Tab-Drosselung oder den Engine-Ausfall
verunreinigt. Der Hebel bleibt damit **plausibel, aber nicht sauber belegt**.
Zurueckgenommen wird er nicht - die Begruendung haengt am Quellcode, nicht an
der Messung: Oberhalb von 50 Prozent Ausdauer ist die Strafe exakt 1.

Nachtrag zur HP-Schwelle: 0,95 war unerreichbar und hielt den Motor in der
Kammer fest; seit 20:47 steht sie auf 0,75.
Commit: (siehe git log, blade.js 25.08.)
